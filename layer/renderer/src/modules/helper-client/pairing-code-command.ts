import { HELPER_BIN_DIR, HELPER_BIN_NAME } from './install-command'

export const HELPER_PAIRING_CODE_COMMAND = `~/${HELPER_BIN_DIR}/${HELPER_BIN_NAME} code`

export const HELPER_PAIRING_CODE_JOURNAL_COMMAND = `journalctl --user -u ${HELPER_BIN_NAME} -n 50 --no-pager | grep 'pairing code'`
