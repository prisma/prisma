import { render, Box } from 'ink'
import React from 'react'
import { TabIndexProvider } from './components/TabIndex'
import { Router, Route } from './components/Router'
import Step0StarterVsBlank from './screens/Step0StarterVsBlank'
import Step2DBSelection from './screens/Step2DBSelection'
import Step1StarterSelection from './screens/Step1StarterSelection'
import Step61Success from './screens/Step61Success'
import Step2SqliteFileSelection from './screens/Step2SqliteFileSelection'
import Step21SqliteFilePath from './screens/Step21SqliteFilePath'
import Step22ToolSelection from './screens/Step22ToolSelection'
import Step60ProcessBlank from './screens/Step60ProcessBlank'
import Step4DemoScriptSelection from './screens/Step4DemoScriptSelection'
import Step60DownloadExample from './screens/Step60DownloadExample'

export async function initPrompt(outputDir: string) {
  return new Promise(resolve => {
    render(
      <Box marginTop={1} flexDirection="column">
        <TabIndexProvider>
          <Router defaultRoute="home">
            <Route path="home" component={<Step0StarterVsBlank outputDir={outputDir} />} />
            <Route path="starter-selection" component={<Step1StarterSelection />} />
            <Route path="db-selection" component={<Step2DBSelection />} />
            <Route path="sqlite-file-selection" component={<Step2SqliteFileSelection />} />
            <Route path="sqlite-file-path" component={<Step21SqliteFilePath />} />
            <Route path="tool-selection" component={<Step22ToolSelection />} />
            <Route path="demo-script-selection" component={<Step4DemoScriptSelection />} />
            <Route path="process-blank" component={<Step60ProcessBlank />} />
            <Route path="download-example" component={<Step60DownloadExample />} />
            <Route path="success" component={<Step61Success />} />
          </Router>
        </TabIndexProvider>
      </Box>,
    )
  })
}
