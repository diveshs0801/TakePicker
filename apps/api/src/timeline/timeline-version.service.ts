import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  Timeline,
  TimelineBranch,
  TimelineRevision,
  ThreeWayMergeResult,
  ConflictResolutionStrategy,
  TimelineConflict,
} from '../../../../packages/contracts';
import { threeWayMerge, computeTimelineHash, diffTimelines, applyPatch } from './timeline-merge.engine';
import { validateTimelineInvariants } from './timeline.invariants';
import { randomUUID } from 'node:crypto';

@Injectable()
export class TimelineVersionService {
  // In-memory version graph store (persisted to database / Redis in production)
  private readonly branches = new Map<string, TimelineBranch[]>();
  private readonly revisions = new Map<string, Map<string, TimelineRevision>>();
  private readonly activeTimelines = new Map<string, Map<string, Timeline>>();

  /**
   * Initializes default 'main' branch for an asset with its initial timeline.
   */
  ensureMainBranch(assetId: string, initialTimeline: Timeline): TimelineBranch {
    if (!this.branches.has(assetId)) {
      this.branches.set(assetId, []);
      this.revisions.set(assetId, new Map());
      this.activeTimelines.set(assetId, new Map());
    }

    const assetBranches = this.branches.get(assetId)!;
    let mainBranch = assetBranches.find((b) => b.name === 'main');

    if (!mainBranch) {
      const revisionId = `rev_init_${randomUUID().slice(0, 8)}`;
      const branchId = `branch_main_${randomUUID().slice(0, 8)}`;
      const hash = computeTimelineHash(initialTimeline);

      const initRev: TimelineRevision = {
        id: revisionId,
        branchId,
        parentRevisionIds: [],
        author: 'system',
        message: 'Initial project baseline (TakePicker master cut)',
        timestamp: new Date().toISOString(),
        timelineHash: hash,
        timelineSnapshot: initialTimeline,
      };

      mainBranch = {
        id: branchId,
        name: 'main',
        assetId,
        headRevisionId: revisionId,
        baseRevisionId: revisionId,
        author: 'system',
        description: 'Production broadcast master timeline',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isProtected: true,
      };

      assetBranches.push(mainBranch);
      this.revisions.get(assetId)!.set(revisionId, initRev);
      this.activeTimelines.get(assetId)!.set('main', initialTimeline);
    }

    return mainBranch;
  }

  /**
   * Creates a new branch for parallel multi-user or agent editing.
   */
  createBranch(
    assetId: string,
    branchName: string,
    author: string,
    description?: string,
    fromBranchName: string = 'main'
  ): TimelineBranch {
    const assetBranches = this.branches.get(assetId) || [];
    if (assetBranches.some((b) => b.name === branchName)) {
      throw new BadRequestException(`Branch "${branchName}" already exists for asset ${assetId}`);
    }

    const sourceBranch = assetBranches.find((b) => b.name === fromBranchName);
    if (!sourceBranch) {
      throw new NotFoundException(`Source branch "${fromBranchName}" not found`);
    }

    const branchId = `branch_${branchName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${randomUUID().slice(0, 6)}`;
    const sourceTimeline = this.activeTimelines.get(assetId)!.get(fromBranchName)!;

    // Clone working copy of the timeline
    const workingCopy: Timeline = {
      assetId,
      fps: sourceTimeline.fps,
      clips: sourceTimeline.clips.map((c) => ({ ...c })),
    };

    const newBranch: TimelineBranch = {
      id: branchId,
      name: branchName,
      assetId,
      headRevisionId: sourceBranch.headRevisionId,
      baseRevisionId: sourceBranch.headRevisionId,
      author,
      description: description || `Branch ${branchName} branched from ${fromBranchName}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isProtected: false,
    };

    assetBranches.push(newBranch);
    this.branches.set(assetId, assetBranches);
    this.activeTimelines.get(assetId)!.set(branchName, workingCopy);

    return newBranch;
  }

  /**
   * Lists all branches for an asset.
   */
  listBranches(assetId: string): TimelineBranch[] {
    return this.branches.get(assetId) || [];
  }

  /**
   * Gets current timeline for a branch.
   */
  getBranchTimeline(assetId: string, branchName: string): Timeline {
    const assetTimelines = this.activeTimelines.get(assetId);
    if (!assetTimelines || !assetTimelines.has(branchName)) {
      throw new NotFoundException(`Timeline for branch "${branchName}" not found`);
    }
    return assetTimelines.get(branchName)!;
  }

  /**
   * Commits edits onto a specific branch.
   */
  commitRevision(
    assetId: string,
    branchName: string,
    author: string,
    message: string,
    updatedTimeline: Timeline
  ): TimelineRevision {
    validateTimelineInvariants(updatedTimeline);

    const assetBranches = this.branches.get(assetId) || [];
    const branch = assetBranches.find((b) => b.name === branchName);
    if (!branch) {
      throw new NotFoundException(`Branch "${branchName}" not found`);
    }

    const revisionMap = this.revisions.get(assetId)!;
    const parentRev = revisionMap.get(branch.headRevisionId);

    const revisionId = `rev_${randomUUID().slice(0, 8)}`;
    const hash = computeTimelineHash(updatedTimeline);

    // Compute delta patch from parent revision
    const patch = parentRev ? diffTimelines(parentRev.timelineSnapshot, updatedTimeline).operations : [];

    const newRevision: TimelineRevision = {
      id: revisionId,
      branchId: branch.id,
      parentRevisionIds: parentRev ? [parentRev.id] : [],
      author,
      message,
      timestamp: new Date().toISOString(),
      timelineHash: hash,
      timelineSnapshot: updatedTimeline,
      patchFromParent: patch,
    };

    revisionMap.set(revisionId, newRevision);
    branch.headRevisionId = revisionId;
    branch.updatedAt = new Date().toISOString();
    this.activeTimelines.get(assetId)!.set(branchName, updatedTimeline);

    return newRevision;
  }

  /**
   * Performs a 3-way merge from a source branch into target branch (e.g. into 'main').
   */
  mergeBranches(
    assetId: string,
    sourceBranchName: string,
    targetBranchName: string = 'main',
    conflictStrategy: ConflictResolutionStrategy = 'SPLIT_AUDITION_LANES'
  ): ThreeWayMergeResult {
    const assetBranches = this.branches.get(assetId) || [];
    const sourceBranch = assetBranches.find((b) => b.name === sourceBranchName);
    const targetBranch = assetBranches.find((b) => b.name === targetBranchName);

    if (!sourceBranch) throw new NotFoundException(`Source branch "${sourceBranchName}" not found`);
    if (!targetBranch) throw new NotFoundException(`Target branch "${targetBranchName}" not found`);

    const revisionMap = this.revisions.get(assetId)!;
    const baseRev = revisionMap.get(sourceBranch.baseRevisionId);
    if (!baseRev) {
      throw new BadRequestException(`Common ancestor base revision "${sourceBranch.baseRevisionId}" not found`);
    }

    const baseTimeline = baseRev.timelineSnapshot;
    const oursTimeline = this.activeTimelines.get(assetId)!.get(targetBranchName)!;
    const theirsTimeline = this.activeTimelines.get(assetId)!.get(sourceBranchName)!;

    const mergeResult = threeWayMerge(baseTimeline, oursTimeline, theirsTimeline, {
      oursBranchName: targetBranchName,
      theirsBranchName: sourceBranchName,
      defaultConflictStrategy: conflictStrategy,
    });

    // If clean or auto-resolved via audition lanes, commit the merge revision into target branch
    const mergeRevId = `rev_merge_${randomUUID().slice(0, 8)}`;
    const mergeHash = computeTimelineHash(mergeResult.mergedTimeline);

    const mergeRevision: TimelineRevision = {
      id: mergeRevId,
      branchId: targetBranch.id,
      parentRevisionIds: [targetBranch.headRevisionId, sourceBranch.headRevisionId],
      author: 'system',
      message: `Merged branch "${sourceBranchName}" into "${targetBranchName}" (${mergeResult.appliedOpsCount} ops applied, ${mergeResult.conflicts.length} conflicts)`,
      timestamp: new Date().toISOString(),
      timelineHash: mergeHash,
      timelineSnapshot: mergeResult.mergedTimeline,
    };

    revisionMap.set(mergeRevId, mergeRevision);
    targetBranch.headRevisionId = mergeRevId;
    targetBranch.updatedAt = new Date().toISOString();
    this.activeTimelines.get(assetId)!.set(targetBranchName, mergeResult.mergedTimeline);

    return mergeResult;
  }
}
