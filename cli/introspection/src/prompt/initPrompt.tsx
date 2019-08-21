import { render } from 'ink'
import React from 'react'
import { TabIndexProvider } from './components/TabIndex'
import { Router, Route } from './components/Router'
import Step0StarterVsBlank from './screens/Step0StarterVsBlank'
import Step2DBSelection from './screens/Step2DBSelection'
import Step1Starter from './screens/Step1Starter'
import Step6Success from './screens/Step6Success'

export async function initPrompt(outputDir?: string) {
  // go crazy on handling the outputDir...

  return new Promise(resolve => {
    render(
      <TabIndexProvider>
        <Router defaultRoute="home">
          <Route path="home" component={<Step0StarterVsBlank />} />
          <Route path="starter-selection" component={<Step1Starter />} />
          <Route path="db-selection" component={<Step2DBSelection />} />
          <Route path="success" component={<Step6Success />} />
        </Router>
      </TabIndexProvider>,
    )
  })
}
