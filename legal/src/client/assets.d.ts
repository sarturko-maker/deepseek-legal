/** Browser build CSS Modules declarations. */
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>
  export default classes
}
