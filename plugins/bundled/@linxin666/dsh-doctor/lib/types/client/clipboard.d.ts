/**
 * Clipboard write shared by the recovery console surfaces (the send-to-Harness
 * dialog copy button and the failed-plugin row copy). Never rejects and never
 * throws: an unavailable clipboard degrades to a false result instead of
 * breaking the console.
 * @module @linxin666/dsh-doctor/client
 */
/** Copy text to the clipboard; resolves to whether it landed. */
export declare function copyText(value: string): Promise<boolean>;
