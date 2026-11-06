// Two lines written on top of each other: the layout check must flag this (exit code 3).
export const PAGES = [async (c) => {
  await c.T('这两行字压在一起', 80, 400, 60);
  await c.T('这两行字压在一起', 90, 410, 60);
}];
