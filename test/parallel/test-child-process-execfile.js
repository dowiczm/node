'use strict';

const common = require('../common');
const assert = require('assert');
const execFile = require('child_process').execFile;
const { getEventListeners } = require('events');
const { getSystemErrorName } = require('util');
const fixtures = require('../common/fixtures');

const fixture = fixtures.path('exit.js');
const echoFixture = fixtures.path('echo.js');
const execOpts = { encoding: 'utf8', shell: true };

{
  execFile(
    process.execPath,
    [fixture, 42],
    common.mustCall((e) => {
      // Check that arguments are included in message
      assert.strictEqual(e.message.trim(),
                         `Command failed: ${process.execPath} ${fixture} 42`);
      assert.strictEqual(e.code, 42);
    })
  );
}

{
  // Verify that negative exit codes can be translated to UV error names.
  const errorString = `Error: Command failed: ${process.execPath}`;
  const code = -1;
  const callback = common.mustCall((err, stdout, stderr) => {
    assert.strictEqual(err.toString().trim(), errorString);
    assert.strictEqual(err.code, getSystemErrorName(code));
    assert.strictEqual(err.killed, true);
    assert.strictEqual(err.signal, null);
    assert.strictEqual(err.cmd, process.execPath);
    assert.strictEqual(stdout.trim(), '');
    assert.strictEqual(stderr.trim(), '');
  });
  const child = execFile(process.execPath, callback);

  child.kill();
  child.emit('close', code, null);
}

{
  // Verify the shell option works properly
  execFile(process.execPath, [fixture, 0], execOpts, common.mustSucceed());
}

{
  // Verify that the signal option works properly
  const ac = new AbortController();
  const { signal } = ac;

  const callback = common.mustCall((err) => {
    assert.strictEqual(err.code, 'ABORT_ERR');
    assert.strictEqual(err.name, 'AbortError');
  });
  execFile(process.execPath, [echoFixture, 0], { signal }, callback);
  ac.abort();
}

{
  // Verify that if something different than Abortcontroller.signal
  // is passed, ERR_INVALID_ARG_TYPE is thrown
  assert.throws(() => {
    const callback = common.mustNotCall(() => {});

    execFile(process.execPath, [echoFixture, 0], { signal: 'hello' }, callback);
  }, { code: 'ERR_INVALID_ARG_TYPE', name: 'TypeError' });
}
{
  // Verify that the process completing removes the abort listener
  const ac = new AbortController();
  const { signal } = ac;

  const callback = common.mustCall((err) => {
    assert.strictEqual(getEventListeners(ac.signal).length, 0);
    assert.strictEqual(err, null);
  });
  execFile(process.execPath, [fixture, 0], { signal }, callback);
}
