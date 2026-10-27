# Working rules for AI assistants and editors (Claude Code, Antigravity, others)

This folder is a git clone of `https://github.com/ranklydesign/labelorigin` (branch `main`).
GitHub Pages serves `main` at https://labelorigin.com, so **GitHub `main` is the single source of truth**.

1. **Work only in this folder.** Never copy the site to another folder, a zip, or a "backup" and edit that. Copies are how versions drift.
2. **Pull before you edit.** Run `.\sync.ps1` (or `git pull --rebase origin main`) at the start of every session.
3. **Push when you finish.** Run `.\sync.ps1 "short description"` at the end. It pulls, commits, and pushes. Do not leave finished work uncommitted.
4. **One tool at a time.** If Claude and Antigravity are both open, finish and sync in one before editing in the other.
5. **Run git from this folder.** The parent folders belong to a different, unrelated git repo.
6. **Check the account.** Pushes must go out as `ranklydesign` (`gh auth status`). `sync.ps1` switches to it automatically.

## Site facts

- Static site: plain HTML, CSS, JavaScript. No build step.
- LabelOrigin is a B2B lead-generation agency run by ranklydesign. Renaud Naturals is the flagship client, and `/renaud/` is its paid-ads landing funnel.
- Theme tokens live at the top of `style.css`; the Renaud brand skin is at the bottom of `renaud/renaud.css` (`html[data-brand="renaud"]`).
- Lead forms post to FormSubmit (`ranklydesign@gmail.com`). `assets/js/contact.js` makes email and phone links copy instead of opening a mail or phone app.
- When adding a page, also add it to `sitemap.xml`, and give it a unique title, description, and canonical URL.
