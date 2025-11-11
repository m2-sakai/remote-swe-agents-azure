/**
 * Utility functions for formatting and cleaning message content
 */

/**
 * Adds trailing spaces to URLs in the message
 *
 * @param message The message content to process
 * @returns The message with spaces added after URLs
 */
function addSpacesToUrls(message: string): string {
  // Regular expression to match URLs
  // https://stackoverflow.com/a/3809435
  const urlRegex =
    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;

  // Add trailing space to URLs
  return message.replace(urlRegex, (match) => {
    return ' ' + match + ' ';
  });
}

export function formatMessage(message: string): string {
  // Add trailing spaces to URLs
  message = addSpacesToUrls(message);

  // Remove any leading or trailing whitespace
  return message.trim();
}

export function extractUserMessage(message: string | undefined): string {
  if (!message) return message ?? '';

  if (!message.includes('<user_message>') || !message.includes('</user_message>')) {
    return message.trim();
  }

  return message
    .slice(message.indexOf('<user_message>') + '<user_message>'.length, message.indexOf('</user_message>'))
    .trim();
}
