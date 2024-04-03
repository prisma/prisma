/**
 * Original source code is from the capture-stdout npm package.
 * The source code was modified slightly.
 * The comments below are from the original source code.
 * Thanks to the author for sharing <3
 * https://github.com/BlueOtterSoftware/capture-stdout/blob/3dd86eda94e6e6a10861a8d898859d12d14e4e0b/capture-stdout.js
 *
 * @file capture-stdout.js
 * Provides a class to capture stdout, storing the stream in a string.
 * Useful for testing :)
 *
 * I stole this from Steve Farthing who got it from a gist from Ben Buckman
 * who got it from Preston Guillory
 *
 * @author Randy Carver
 * @date 7/21/17
 *
 * Copyright © 2017 Blue Otter Software - All Rights Reserved
 * The MyBooks tutorial project is Licensed under the MIT License.
 * See LICENSE.md file in the project root for full license information.
 * {@link https://github.com/rpcarver/mybooks|MyBooks Github Repository }
 * {@link http://blueottersoftware.com/2017/06/19/mybooks-tutorial-index/MyBooks Tutorial Index}
 * {@link https://www.linkedin.com/in/randycarver/|LinkedIn}
 */

/**
 * This class captures the stdout and stores each write in an array of strings.
 */
export class CaptureStdout {
  private _capturedText: string[]
  private _orig_stdout_write: typeof process.stdout.write | null

  constructor() {
    this._capturedText = []
    this._orig_stdout_write = null
  }

  /**
   * Starts capturing the writes to process.stdout
   */
  startCapture() {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    this._orig_stdout_write = process.stdout.write
    // @ts-ignore
    process.stdout.write = this._writeCapture.bind(this)
  }

  /**
   * Stops capturing the writes to process.stdout.
   */
  stopCapture() {
    if (this._orig_stdout_write) {
      process.stdout.write = this._orig_stdout_write
    }
  }

  /**
   * Private method that is used as the replacement write function for process.stdout
   * @param string
   * @private
   */
  _writeCapture(string) {
    this._capturedText.push(string)
  }

  /**
   * Retrieve the text that has been captured since creation or since the last clear call
   * @returns {Array} of Strings
   */
  getCapturedText() {
    return this._capturedText
  }

  /**
   * Clears all of the captured text
   */
  clearCaptureText() {
    this._capturedText = []
  }
}
