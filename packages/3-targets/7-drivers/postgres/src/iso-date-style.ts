import type { ClientConfig } from 'pg';
import { parseIntoClientConfig } from 'pg-connection-string';

const ISO_DATE_STYLE_OPTION = '-c DateStyle=ISO';

/**
 * The settings of a connection Prisma opens from `url`: what the URL says, with `DateStyle=ISO` added as a startup option after any the URL gives. A startup option sets the session's default, so `RESET ALL` keeps it, and the string date and time codecs read only ISO text.
 */
export function isoDateStyleConnectionConfig(url: string): ClientConfig {
  const config = parseIntoClientConfig(url);
  return {
    ...config,
    options:
      config.options === undefined
        ? ISO_DATE_STYLE_OPTION
        : `${config.options} ${ISO_DATE_STYLE_OPTION}`,
  };
}
