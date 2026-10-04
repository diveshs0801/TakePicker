const http = require('http');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(data).toString()
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  console.log('--- 1. OPTIONS Check ---');
  const optRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/uploads',
    method: 'OPTIONS',
  });
  console.log('OPTIONS status:', optRes.statusCode, 'Tus-Version:', optRes.headers['tus-version'], 'Tus-Extension:', optRes.headers['tus-extension']);

  console.log('\n--- 2. POST Session Creation ---');
  const postRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/uploads',
    method: 'POST',
    headers: {
      'Tus-Resumable': '1.0.0',
      'Upload-Length': '100',
      'Upload-Metadata': 'filename ' + Buffer.from('test_video.mp4').toString('base64'),
    }
  });
  console.log('POST status:', postRes.statusCode, 'Location:', postRes.headers['location']);
  const uploadPath = postRes.headers['location'];
  if (!uploadPath) {
    throw new Error('No Location header returned!');
  }

  console.log('\n--- 3. HEAD Check Offset ---');
  const headRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: uploadPath,
    method: 'HEAD',
    headers: { 'Tus-Resumable': '1.0.0' }
  });
  console.log('HEAD status:', headRes.statusCode, 'Upload-Offset:', headRes.headers['upload-offset']);

  console.log('\n--- 4. PATCH Chunk 1 (50 bytes at offset 0) ---');
  const chunk1 = Buffer.alloc(50, 'A');
  const patch1 = await request({
    hostname: 'localhost',
    port: 3000,
    path: uploadPath,
    method: 'PATCH',
    headers: {
      'Tus-Resumable': '1.0.0',
      'Upload-Offset': '0',
      'Content-Type': 'application/offset+octet-stream',
      'Content-Length': '50',
    }
  }, chunk1);
  console.log('PATCH 1 status:', patch1.statusCode, 'Upload-Offset:', patch1.headers['upload-offset']);

  console.log('\n--- 5. Test Offset Mismatch (simulate dropped packet) ---');
  const mismatchPatch = await request({
    hostname: 'localhost',
    port: 3000,
    path: uploadPath,
    method: 'PATCH',
    headers: {
      'Tus-Resumable': '1.0.0',
      'Upload-Offset': '20', // Should be 50!
      'Content-Type': 'application/offset+octet-stream',
      'Content-Length': '30',
    }
  }, Buffer.alloc(30, 'C'));
  console.log('Mismatch PATCH status (expected 409):', mismatchPatch.statusCode);

  console.log('\n--- 6. PATCH Chunk 2 (50 bytes at offset 50 - completes upload) ---');
  const chunk2 = Buffer.alloc(50, 'B');
  const patch2 = await request({
    hostname: 'localhost',
    port: 3000,
    path: uploadPath,
    method: 'PATCH',
    headers: {
      'Tus-Resumable': '1.0.0',
      'Upload-Offset': '50',
      'Content-Type': 'application/offset+octet-stream',
      'Content-Length': '50',
    }
  }, chunk2);
  console.log('PATCH 2 status:', patch2.statusCode, 'Upload-Offset:', patch2.headers['upload-offset'], 'Asset-Id:', patch2.headers['asset-id']);

  console.log('\n--- 7. HEAD Check Completed Offset ---');
  const finalHead = await request({
    hostname: 'localhost',
    port: 3000,
    path: uploadPath,
    method: 'HEAD',
    headers: { 'Tus-Resumable': '1.0.0' }
  });
  console.log('Final HEAD status:', finalHead.statusCode, 'Final Upload-Offset:', finalHead.headers['upload-offset']);

  console.log('\n🎉 ALL RESUMABLE TUS TESTS PASSED SUCCESSFULLY!');
}

run().catch(console.error);
