function asArray(value) { return Array.isArray(value) ? value : []; }
function id(value) { return String(value?.id || ''); }
function name(value, fallback) { return String(value?.name || fallback || 'Unnamed'); }
function channelType(value) { return String(value?.typeName ?? value?.type ?? 'channel'); }

function indexById(items) { return new Map(asArray(items).map((item) => [id(item), item]).filter(([key]) => key)); }

function buildResourcePlan(kind, currentItems, snapshotItems, mode) {
  const current = asArray(currentItems);
  const saved = asArray(snapshotItems);
  const currentById = indexById(current);
  const savedById = indexById(saved);
  const create = saved.filter((item) => !currentById.has(id(item))).map((item) => ({ id: id(item), name: name(item), type: kind === 'channel' ? channelType(item) : undefined }));
  const update = saved.filter((item) => currentById.has(id(item))).map((item) => ({ id: id(item), name: name(item), type: kind === 'channel' ? channelType(item) : undefined }));
  const extra = current.filter((item) => !savedById.has(id(item)));
  const managed = kind === 'role' ? extra.filter((item) => item.managed) : [];
  const removable = extra.filter((item) => kind !== 'role' || !item.managed);
  return {
    create,
    update,
    remove: mode === 'replace' ? removable.map((item) => ({ id: id(item), name: name(item), type: kind === 'channel' ? channelType(item) : undefined })) : [],
    preserve: mode === 'merge' ? extra.map((item) => ({ id: id(item), name: name(item), reason: 'Merge mode preserves resources not present in the snapshot.' })) : managed.map((item) => ({ id: id(item), name: name(item), reason: 'Discord-managed roles cannot be removed by Meowz.' })),
  };
}

function buildRestorePlan(currentLayout, snapshotLayout, requestedMode = 'merge') {
  const mode = requestedMode === 'replace' ? 'replace' : 'merge';
  const current = currentLayout || {};
  const snapshot = snapshotLayout || {};
  const roles = buildResourcePlan('role', current.roles, snapshot.roles, mode);
  const channels = buildResourcePlan('channel', current.channels, snapshot.channels, mode);
  const destructiveCount = roles.remove.length + channels.remove.length;
  const createCount = roles.create.length + channels.create.length;
  const updateCount = roles.update.length + channels.update.length;
  return {
    mode,
    previewOnly: true,
    requiresPreRestoreSnapshot: true,
    idRemappingRequired: createCount > 0,
    summary: { create: createCount, update: updateCount, remove: destructiveCount, preserve: roles.preserve.length + channels.preserve.length },
    roles,
    channels,
    warnings: [
      'This is a preview only. No Discord resources will be changed.',
      ...(mode === 'replace' && destructiveCount ? ['Replace mode would remove current resources that are absent from the snapshot.'] : []),
      ...(createCount ? ['Recreated Discord roles/channels receive new IDs, so restore execution must remap parent and permission-overwrite references.'] : []),
      ...(roles.preserve.length && mode === 'replace' ? ['Discord-managed roles are excluded from deletion.'] : []),
      'Restore execution must create an automatic pre-restore snapshot before applying any changes.',
    ],
  };
}

module.exports = { buildRestorePlan };
