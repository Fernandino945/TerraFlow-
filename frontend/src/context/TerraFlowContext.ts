import { createContext } from 'react'

export type ConnectionState = 'loading' | 'online' | 'offline'

export const TerraFlowContext = createContext({
  connection: 'loading' as ConnectionState,
  setConnection: (_state: ConnectionState) => {},
  refreshVersion: 0,
})
