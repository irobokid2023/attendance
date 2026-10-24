<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Drive storage usage must batch parent folders into bounded list requests, cap concurrent connector calls, cache results briefly, and load independently to reduce rate limits and edge-function idle timeouts.
- Keep unfinished marking workflows in user-scoped browser drafts and restore them before fetched records overwrite local edits, so backgrounded or restarted apps can recover unsaved work.
