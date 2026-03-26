# git-calendar

Visualize any git repository's history as a beautiful calendar heatmap — right in your browser.

![git-calendar](https://github.com/user-attachments/assets/placeholder.png)

## Features

- Calendar view of commits with copper/terracotta heatmap
- Hover any day to see full commit details
- Author avatars with consistent color coding
- Auto-scrolls to today with a red highlight
- Scrollable history from first commit to present
- Zero dependencies — just Node.js and git

## Install

```bash
npm install -g git-calendar
```

## Usage

```bash
# Run in any git repo
cd my-project
git-calendar

# Or point to a repo
git-calendar ~/projects/my-repo

# Only last 6 months
git-calendar --since "6 months ago"

# Generate without opening
git-calendar --no-open
```

The generated HTML is saved to `~/.git-calendar/<repo-name>.html`. Press Enter when prompted to open it in your browser.

## Options

| Option | Description | Default |
|---|---|---|
| `path` | Path to a git repository | Current directory |
| `--since` | How far back to look | Full history |
| `--no-open` | Skip the browser prompt | `false` |
| `-h, --help` | Show help | |

## How it works

1. Reads `git log` from the target repository
2. Groups commits by day and author
3. Generates a self-contained HTML file with all data embedded
4. Renders a calendar grid with heatmap intensity based on commit count

No data leaves your machine. Everything runs locally.

## License

MIT
