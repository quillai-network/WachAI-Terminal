/**
 * WachAI Terminal ASCII Art Module
 * Provides colorful ASCII art banners and decorations for the CLI
 */

// ANSI color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",

  // Foreground colors
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",

  // Bright foreground colors
  brightRed: "\x1b[91m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightBlue: "\x1b[94m",
  brightMagenta: "\x1b[95m",
  brightCyan: "\x1b[96m",
  brightWhite: "\x1b[97m",
};

/**
 * Check if terminal supports colors
 */
function supportsColor(): boolean {
  // Check for common environment indicators
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR) return true;
  if (!process.stdout.isTTY) return false;
  return true;
}

/**
 * Apply color to text (only if terminal supports it)
 */
function colorize(text: string, color: string): string {
  if (!supportsColor()) return text;
  return `${color}${text}${colors.reset}`;
}

/**
 * Main WachAI ASCII art logo with gradient colors
 */
export function getWachAILogo(): string {
  const c = supportsColor() ? colors : {
    reset: "", bold: "", dim: "",
    cyan: "", brightCyan: "", magenta: "", brightMagenta: "",
    yellow: "", brightYellow: "", green: "", brightGreen: "",
    blue: "", brightBlue: "", white: "", brightWhite: "", red: "", brightRed: ""
  };

  // Gradient effect using cyan -> magenta -> yellow
  const logo = `
${c.brightCyan}██╗    ██╗${c.cyan} █████╗  ${c.brightMagenta}██████╗${c.magenta}██╗  ██╗${c.brightYellow} █████╗ ${c.yellow}██╗${c.reset}
${c.brightCyan}██║    ██║${c.cyan}██╔══██╗ ${c.brightMagenta}██╔════╝${c.magenta}██║  ██║${c.brightYellow}██╔══██╗${c.yellow}██║${c.reset}
${c.brightCyan}██║ █╗ ██║${c.cyan}███████║ ${c.brightMagenta}██║     ${c.magenta}███████║${c.brightYellow}███████║${c.yellow}██║${c.reset}
${c.brightCyan}██║███╗██║${c.cyan}██╔══██║ ${c.brightMagenta}██║     ${c.magenta}██╔══██║${c.brightYellow}██╔══██║${c.yellow}██║${c.reset}
${c.brightCyan}╚███╔███╔╝${c.cyan}██║  ██║ ${c.brightMagenta}╚██████╗${c.magenta}██║  ██║${c.brightYellow}██║  ██║${c.yellow}██║${c.reset}
${c.brightCyan} ╚══╝╚══╝ ${c.cyan}╚═╝  ╚═╝ ${c.brightMagenta} ╚═════╝${c.magenta}╚═╝  ╚═╝${c.brightYellow}╚═╝  ╚═╝${c.yellow}╚═╝${c.reset}
`;

  return logo;
}

/**
 * Terminal subtitle with styling
 */
export function getTerminalSubtitle(): string {
  const c = supportsColor() ? colors : { reset: "", dim: "", brightWhite: "", cyan: "" };

  return `${c.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}
${c.brightWhite}        ⚡ ${c.cyan}M A N D A T E S   T E R M I N A L${c.brightWhite} ⚡${c.reset}
${c.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`;
}

/**
 * Get the full banner (logo + subtitle)
 */
export function getFullBanner(): string {
  return `${getWachAILogo()}${getTerminalSubtitle()}`;
}

/**
 * Decorative box around text
 */
export function boxText(text: string, title?: string): string {
  const c = supportsColor() ? colors : { reset: "", cyan: "", dim: "", brightWhite: "" };
  const lines = text.split('\n');
  const maxLen = Math.max(...lines.map(l => l.replace(/\x1b\[[0-9;]*m/g, '').length));
  const width = Math.max(maxLen + 4, (title?.length ?? 0) + 6);

  const top = title
    ? `${c.cyan}╭─${c.brightWhite} ${title} ${c.cyan}${'─'.repeat(width - title.length - 4)}╮${c.reset}`
    : `${c.cyan}╭${'─'.repeat(width)}╮${c.reset}`;
  const bottom = `${c.cyan}╰${'─'.repeat(width)}╯${c.reset}`;

  const paddedLines = lines.map(line => {
    const visibleLen = line.replace(/\x1b\[[0-9;]*m/g, '').length;
    const padding = ' '.repeat(width - visibleLen - 2);
    return `${c.cyan}│${c.reset} ${line}${padding}${c.cyan}│${c.reset}`;
  });

  return [top, ...paddedLines, bottom].join('\n');
}

/**
 * Status indicator with color
 */
export function statusIcon(status: 'success' | 'error' | 'warning' | 'info'): string {
  const c = supportsColor() ? colors : { reset: "", green: "", red: "", yellow: "", blue: "" };
  const icons: Record<string, string> = {
    success: `${c.green}✓${c.reset}`,
    error: `${c.red}✗${c.reset}`,
    warning: `${c.yellow}⚠${c.reset}`,
    info: `${c.blue}ℹ${c.reset}`,
  };
  return icons[status] ?? icons.info;
}

/**
 * Progress spinner frames (for animated CLI)
 */
export const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * Section header with decorative styling
 */
export function sectionHeader(title: string): string {
  const c = supportsColor() ? colors : { reset: "", brightCyan: "", dim: "" };
  return `\n${c.brightCyan}▸ ${title}${c.reset}\n${c.dim}${'─'.repeat(title.length + 2)}${c.reset}`;
}

/**
 * Compact one-line banner for minimal output
 */
export function getCompactBanner(): string {
  const c = supportsColor() ? colors : { reset: "", bold: "", dim: "", cyan: "", magenta: "", yellow: "" };
  return `${c.bold}${c.cyan}Wach${c.magenta}AI${c.reset} ${c.yellow}Terminal${c.reset} ${c.dim}v0.0.3${c.reset}`;
}

/**
 * Credits/footer text
 */
export function getFooter(): string {
  const c = supportsColor() ? colors : { reset: "", dim: "", cyan: "" };
  return `${c.dim}─────────────────────────────────────────────────────────${c.reset}
${c.dim}Powered by ${c.cyan}QuillAI Network${c.dim} │ github.com/quillai-network${c.reset}`;
}

// Export colors for external use
export { colors, colorize, supportsColor };
