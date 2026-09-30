/** Matches [`CustomerTabBar`](apps/client/src/components/home/CustomerTabBar.tsx) row + padding (excludes floating active-order bar). */
export function customerTabBarHeight(safeBottom: number) {
  return 8 + 46 + Math.max(safeBottom, 8);
}
