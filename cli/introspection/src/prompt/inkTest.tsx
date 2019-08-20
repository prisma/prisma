import { render } from 'ink'
import React from 'react'
import { TabIndexProvider } from './components/TabIndex'
import { Router, Route } from './components/Router'
import { TabApp } from './screens/TabApp'
import { TabApp2 } from './screens/TabApp2'

export function renderInk() {
  return new Promise(resolve => {
    render(
      <TabIndexProvider>
        <Router defaultRoute="home">
          <Route path="home" component={<TabApp />} />
          <Route path="asd" component={<TabApp2 />} />
        </Router>
      </TabIndexProvider>,
    )
  })
}
