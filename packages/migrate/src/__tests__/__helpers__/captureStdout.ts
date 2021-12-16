class CaptureStdout {
  capturedText: string[]
  oldStdoutWrite: any
  constructor() {
    this.capturedText = []
    this.oldStdoutWrite = null
  }

  public startCapture = () => {
    /* eslint-disable @typescript-eslint/unbound-method */
    this.oldStdoutWrite = process.stdout.write
    //@ts-ignore
    process.stdout.write = this.writeCapture
  }

  public stopCapture = () => {
    if (this.oldStdoutWrite) {
      process.stdout.write = this.oldStdoutWrite
    }
  }

  private writeCapture = (string) => {
    this.capturedText.push(string.replace(/\n/g, ''))
  }

  public getCapturedText = () => {
    return this.capturedText
  }

  public clearCaptureText = () => {
    this.capturedText = []
  }
}

export default CaptureStdout
