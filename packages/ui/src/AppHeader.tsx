type AppHeaderProps = {
  title: string;
};

// Shared top bar. Layout uses logical properties (start/end), so it reads right-to-left.
export function AppHeader({ title }: AppHeaderProps) {
  return (
    <header className="border-b border-stone-200 bg-white px-4 py-3">
      <h1 className="text-start text-lg font-semibold">{title}</h1>
    </header>
  );
}
