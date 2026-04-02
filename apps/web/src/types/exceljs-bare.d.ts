// Type shim for the ExcelJS browser bundle entry point.
// The actual typings live in the `exceljs` package; this just
// re-exports them so TypeScript resolves the bare browser import.
declare module "exceljs/dist/exceljs.bare.min.js" {
  import ExcelJS from "exceljs";
  export default ExcelJS;
}
