import { createDemoBridge } from '../demo'

export const api = window.plumbago || (window.__plumbagoDemoBridge ||= createDemoBridge())

export const emptyContext = {
  root: '',
  runtime: { kind: 'native' },
  hugo: null,
  hugoExecutable: '',
  git: null,
}
