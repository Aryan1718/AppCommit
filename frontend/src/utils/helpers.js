export function getDisplayName(email) {
  if (!email) {
    return 'User';
  }

  const name = String(email).split('@')[0];
  const formattedName = name
    .replace(/[._-]/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .trim();

  return formattedName || 'User';
}
