// Broad host access is declared at install time. If Chrome restricts site access,
// restoring it still requires a click; downloads never fabricate permission.
export const automaticOrigins=['http://*/*','https://*/*'];
export function automaticAccessGranted(){return chrome.permissions.contains({origins:automaticOrigins});}
export async function requestAccess(origins:string[],afterGrant:()=>Promise<void>) {
  const request=chrome.permissions.request({origins});
  if(!await request)throw new Error('未授予站点访问权限');
  await afterGrant();
}
