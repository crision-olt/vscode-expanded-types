import type * as ts from 'typescript';
function init(_modules: { typescript: typeof ts }) {
  function create() { return {}; }
  function onConfigurationChanged(_config: unknown) {}
  return { create, onConfigurationChanged };
}
module.exports = init;
