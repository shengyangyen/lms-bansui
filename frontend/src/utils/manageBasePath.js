/**
 * 依目前網址判斷管理後台前綴（admin 或導師 teacher）
 */
export function getManageBaseFromPath(pathname) {
  if (pathname.startsWith('/teacher')) return '/teacher';
  return '/admin';
}
