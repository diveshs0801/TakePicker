use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

/// Model for a timeline clip
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Clip {
    pub id: String,
    pub r#in: f64,
    pub out: f64,
    pub track_id: Option<String>,
    pub gain: Option<f64>,
    pub speed: Option<f64>,
    pub color_tag: Option<String>,
    pub audition_group: Option<String>,
}

/// Model for a timeline
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Timeline {
    pub asset_id: String,
    pub fps: f64,
    pub clips: Vec<Clip>,
}

/// Typed timeline conflict taxonomy
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum ConflictType {
    TrimTrim,
    DeleteEdit,
    MoveMove,
    TrackOcclusion,
    SemanticViolation,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum ResolutionStrategy {
    KeepOurs,
    KeepTheirs,
    SplitAuditionLanes,
    BlendFieldwise,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TimelineConflict {
    pub id: String,
    pub conflict_type: ConflictType,
    pub clip_id: String,
    pub description: String,
    pub recommended_strategy: ResolutionStrategy,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MergeStats {
    pub total_clips: usize,
    pub clean_merges: usize,
    pub conflicts_count: usize,
    pub duration_seconds: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ThreeWayMergeResult {
    pub merged: Timeline,
    pub conflicts: Vec<TimelineConflict>,
    pub stats: MergeStats,
}

/// Longest Increasing Subsequence in O(N log N)
pub fn longest_increasing_subsequence(arr: &[usize]) -> Vec<usize> {
    if arr.is_empty() {
        return Vec::new();
    }
    let mut tails = Vec::new();
    let mut tail_indices = Vec::new();
    let mut parent = vec![None; arr.len()];

    for (i, &x) in arr.iter().enumerate() {
        let idx = tails.binary_search(&x).unwrap_or_else(|e| e);
        if idx == tails.len() {
            tails.push(x);
            tail_indices.push(i);
        } else {
            tails[idx] = x;
            tail_indices[idx] = i;
        }
        parent[i] = if idx > 0 { Some(tail_indices[idx - 1]) } else { None };
    }

    let mut lis = Vec::new();
    let mut curr = Some(*tail_indices.last().unwrap());
    while let Some(idx) = curr {
        lis.push(arr[idx]);
        curr = parent[idx];
    }
    lis.reverse();
    lis
}

/// High-performance 3-way timeline merge implementation
pub fn three_way_merge(
    base: &Timeline,
    ours: &Timeline,
    theirs: &Timeline,
) -> ThreeWayMergeResult {
    let base_map: HashMap<String, &Clip> = base.clips.iter().map(|c| (c.id.clone(), c)).collect();
    let ours_map: HashMap<String, &Clip> = ours.clips.iter().map(|c| (c.id.clone(), c)).collect();
    let theirs_map: HashMap<String, &Clip> = theirs.clips.iter().map(|c| (c.id.clone(), c)).collect();

    let mut all_ids = HashSet::new();
    for c in &base.clips { all_ids.insert(c.id.clone()); }
    for c in &ours.clips { all_ids.insert(c.id.clone()); }
    for c in &theirs.clips { all_ids.insert(c.id.clone()); }

    let mut merged_clips = HashMap::new();
    let mut audition_clips = Vec::new();
    let mut conflicts = Vec::new();
    let mut clean_merges = 0;

    for id in &all_ids {
        let b = base_map.get(id);
        let o = ours_map.get(id);
        let t = theirs_map.get(id);

        match (b, o, t) {
            // Both deleted
            (Some(_), None, None) => {
                clean_merges += 1;
            }
            // Ours deleted, theirs modified
            (Some(b_clip), None, Some(t_clip)) => {
                let changed = (b_clip.r#in - t_clip.r#in).abs() > 0.001 || (b_clip.out - t_clip.out).abs() > 0.001;
                if !changed {
                    clean_merges += 1;
                } else {
                    conflicts.push(TimelineConflict {
                        id: format!("del_edit_{}", id),
                        conflict_type: ConflictType::DeleteEdit,
                        clip_id: id.clone(),
                        description: format!("Clip {} was deleted in ours but edited in theirs", id),
                        recommended_strategy: ResolutionStrategy::KeepOurs,
                    });
                }
            }
            // Theirs deleted, ours modified
            (Some(b_clip), Some(o_clip), None) => {
                let changed = (b_clip.r#in - o_clip.r#in).abs() > 0.001 || (b_clip.out - o_clip.out).abs() > 0.001;
                if !changed {
                    clean_merges += 1;
                } else {
                    conflicts.push(TimelineConflict {
                        id: format!("del_edit_{}", id),
                        conflict_type: ConflictType::DeleteEdit,
                        clip_id: id.clone(),
                        description: format!("Clip {} was edited in ours but deleted in theirs", id),
                        recommended_strategy: ResolutionStrategy::KeepOurs,
                    });
                    merged_clips.insert(id.clone(), (*o_clip).clone());
                }
            }
            // Inserted in ours only
            (None, Some(o_clip), None) => {
                merged_clips.insert(id.clone(), (*o_clip).clone());
                clean_merges += 1;
            }
            // Inserted in theirs only
            (None, None, Some(t_clip)) => {
                merged_clips.insert(id.clone(), (*t_clip).clone());
                clean_merges += 1;
            }
            // Inserted in both
            (None, Some(o_clip), Some(t_clip)) => {
                if (o_clip.r#in - t_clip.r#in).abs() < 0.001 && (o_clip.out - t_clip.out).abs() < 0.001 {
                    merged_clips.insert(id.clone(), (*o_clip).clone());
                    clean_merges += 1;
                } else {
                    conflicts.push(TimelineConflict {
                        id: format!("occlusion_{}", id),
                        conflict_type: ConflictType::TrackOcclusion,
                        clip_id: id.clone(),
                        description: format!("Clip {} inserted in both with divergent properties", id),
                        recommended_strategy: ResolutionStrategy::SplitAuditionLanes,
                    });
                    merged_clips.insert(id.clone(), (*o_clip).clone());
                    audition_clips.push((*t_clip).clone());
                }
            }
            // Exists in all three
            (Some(b_clip), Some(o_clip), Some(t_clip)) => {
                let o_trim_changed = (b_clip.r#in - o_clip.r#in).abs() > 0.001 || (b_clip.out - o_clip.out).abs() > 0.001;
                let t_trim_changed = (b_clip.r#in - t_clip.r#in).abs() > 0.001 || (b_clip.out - t_clip.out).abs() > 0.001;

                if !o_trim_changed && !t_trim_changed {
                    merged_clips.insert(id.clone(), (*b_clip).clone());
                    clean_merges += 1;
                } else if o_trim_changed && !t_trim_changed {
                    merged_clips.insert(id.clone(), (*o_clip).clone());
                    clean_merges += 1;
                } else if !o_trim_changed && t_trim_changed {
                    merged_clips.insert(id.clone(), (*t_clip).clone());
                    clean_merges += 1;
                } else {
                    let identical = (o_clip.r#in - t_clip.r#in).abs() < 0.001 && (o_clip.out - t_clip.out).abs() < 0.001;
                    if identical {
                        merged_clips.insert(id.clone(), (*o_clip).clone());
                        clean_merges += 1;
                    } else {
                        // TRIM_TRIM conflict resolved via Audition Lanes
                        conflicts.push(TimelineConflict {
                            id: format!("trim_trim_{}", id),
                            conflict_type: ConflictType::TrimTrim,
                            clip_id: id.clone(),
                            description: format!("Contradictory trims on clip {}", id),
                            recommended_strategy: ResolutionStrategy::SplitAuditionLanes,
                        });
                        let mut primary = (*o_clip).clone();
                        primary.audition_group = Some(format!("audition_{}", id));
                        merged_clips.insert(id.clone(), primary);

                        let mut alt = (*t_clip).clone();
                        alt.id = format!("{}_theirs_alt", id);
                        alt.track_id = Some("V2".to_string());
                        alt.audition_group = Some(format!("audition_{}", id));
                        audition_clips.push(alt);
                    }
                }
            }
            (None, None, None) => {}
        }
    }

    let mut final_clips = Vec::new();
    // Maintain ordering based on ours then remaining
    for c in &ours.clips {
        if let Some(clip) = merged_clips.remove(&c.id) {
            final_clips.push(clip);
        }
    }
    for c in &theirs.clips {
        if let Some(clip) = merged_clips.remove(&c.id) {
            final_clips.push(clip);
        }
    }
    for (_id, clip) in merged_clips {
        final_clips.push(clip);
    }
    for alt in audition_clips {
        final_clips.push(alt);
    }

    let duration: f64 = final_clips.iter().map(|c| c.out - c.r#in).sum();

    ThreeWayMergeResult {
        merged: Timeline {
            asset_id: base.asset_id.clone(),
            fps: base.fps,
            clips: final_clips.clone(),
        },
        conflicts: conflicts.clone(),
        stats: MergeStats {
            total_clips: final_clips.len(),
            clean_merges,
            conflicts_count: conflicts.len(),
            duration_seconds: (duration * 100.0).round() / 100.0,
        },
    }
}
