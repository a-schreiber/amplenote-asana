export function escapeMarkdown(text) {
    return text.replace("[", "\\\\[");
}