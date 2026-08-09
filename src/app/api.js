import { createDemoBridge } from '../demo'

export const api = window.plumbago || createDemoBridge()

export const emptyContext = {
  root: '',
  runtime: { kind: 'native' },
  hugo: null,
  git: null,
}
