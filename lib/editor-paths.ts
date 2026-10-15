/** Maps a public page path ("/", "/about") to its URL inside the admin site editor. */
export function editorHref(path: string) {
  return path === "/" ? "/admin/site-editor" : `/admin/site-editor${path}`
}
