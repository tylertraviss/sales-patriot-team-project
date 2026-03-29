const path = require('path');
const { spawn } = require('child_process');

function usage() {
  console.error('Usage: node src/db/scripts/importAwardsZip.js <zip-file>');
  process.exit(1);
}

const zipArg = process.argv[2];
if (!zipArg) {
  usage();
}

const shardScriptPath = path.join(__dirname, 'importAwardsZipShard.js');
const child = spawn(
  process.execPath,
  [shardScriptPath, zipArg],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      IMPORT_SHARD_COUNT: process.env.IMPORT_SHARD_COUNT || '1',
      IMPORT_SHARD_INDEX: process.env.IMPORT_SHARD_INDEX || '0',
      IMPORT_REFRESH_ON_COMPLETE: process.env.IMPORT_REFRESH_ON_COMPLETE || 'true',
    },
  },
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
