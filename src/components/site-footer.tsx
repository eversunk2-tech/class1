export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 text-xs text-muted-foreground">
        © {new Date().getFullYear()} Class1
      </div>
    </footer>
  );
}
