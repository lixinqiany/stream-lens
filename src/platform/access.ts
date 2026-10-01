import {t} from '../i18n';
// Broad host access is declared at install time. If Chrome restricts site access,
// restoring it still requires a click; downloads never fabricate permission.
export const automaticOrigins=['http://*/*','https://*/*'];
export function automaticAccessGranted(){return chrome.permissions.contains({origins:automaticOrigins});}
export async function requestAccess(origins:string[],afterGrant:()=>Promise<void>) {
  const request=chrome.permissions.request({origins});
  if(!await request)throw new Error(t("site_access_was_not_granted"));
  await afterGrant();
}
