export function friendlyError(error, t) {
  return error?.message?.replace(/^Error invoking remote method '[^']+': Error: /, '') || t('error.generic')
}
