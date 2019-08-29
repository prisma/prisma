import { render, Box } from 'ink'
import React from 'react'
import { TabIndexProvider } from './components/TabIndex'
import { Router, Route } from './components/Router'
import Step0StarterVsBlank from './screens/Step0StarterVsBlank'
import Step1StarterSelection from './screens/Step1StarterSelection'
import Step1MySQLCredentials from './screens/Step1MySQLCredentials'
import Step1PostgresCredentials from './screens/Step1PostgresCredentials'
import Step2DBSelection from './screens/Step2DBSelection'
import Step2SqliteFileSelection from './screens/Step2SqliteFileSelection'
import Step2ChooseDatabase from './screens/Step2ChooseDatabase'
import Step21SqliteFilePath from './screens/Step21SqliteFilePath'
import Step22ToolSelection from './screens/Step22ToolSelection'
import Step3LanguageSelection from './screens/Step3LanguageSelection'
import Step4DemoScriptSelection from './screens/Step4DemoScriptSelection'
import Step4SelectDatabase from './screens/Step4SelectDatabase'
import Step4DatabaseName from './screens/Step4DatabaseName'
import Step41Introspection from './screens/Step41Introspection'
import Step60ProcessBlank from './screens/Step60ProcessBlank'
import Step60DownloadExample from './screens/Step60DownloadExample'
import Step61Success from './screens/Step61Success'

export async function initPrompt(outputDir: string) {
  return new Promise(resolve => {
    render(
      <Box marginTop={1} flexDirection="column">
        <TabIndexProvider>
          <Router defaultRoute="home">
            <Route path="home" component={<Step0StarterVsBlank outputDir={outputDir} />} />
            <Route path="starter-selection" component={<Step1StarterSelection />} />
            <Route path="mysql-credentials" component={<Step1MySQLCredentials />} />
            <Route path="postgres-credentials" component={<Step1PostgresCredentials />} />
            <Route path="db-selection" component={<Step2DBSelection />} />
            <Route path="sqlite-file-selection" component={<Step2SqliteFileSelection />} />
            <Route path="choose-database" component={<Step2ChooseDatabase />} />
            <Route path="sqlite-file-path" component={<Step21SqliteFilePath />} />
            <Route path="tool-selection" component={<Step22ToolSelection />} />
            <Route path="language-selection" component={<Step3LanguageSelection />} />
            <Route path="demo-script-selection" component={<Step4DemoScriptSelection />} />
            <Route path="select-database" component={<Step4SelectDatabase />} />
            <Route path="database-name" component={<Step4DatabaseName />} />
            <Route path="introspection" component={<Step41Introspection />} />
            <Route path="process-blank" component={<Step60ProcessBlank />} />
            <Route path="download-example" component={<Step60DownloadExample />} />
            <Route path="success" component={<Step61Success />} />
          </Router>
        </TabIndexProvider>
      </Box>,
    )
  })
}
