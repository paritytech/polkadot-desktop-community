const MAX_ALIVE_TABS = 6;

export const touchAliveTab = (aliveTabs: string[], id: string): string[] => {
  if (aliveTabs[0] === id) return aliveTabs;

  const without = aliveTabs.filter(x => x !== id);
  const next = [id, ...without];

  return next.length > MAX_ALIVE_TABS ? next.slice(0, MAX_ALIVE_TABS) : next;
};

export const removeAliveTab = (aliveTabs: string[], id: string): string[] => {
  if (!aliveTabs.includes(id)) return aliveTabs;
  return aliveTabs.filter(x => x !== id);
};
