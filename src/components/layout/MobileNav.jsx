import React from 'react';
import { Menu } from 'lucide-react';

const MobileNav = () => {
  return (
    <header className="h-16 border-b bg-background flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-primary rounded-lg" />
        <span className="font-bold text-lg">Botox Clinic</span>
      </div>
      <button className="p-2 hover:bg-accent rounded-md transition-colors">
        <Menu className="w-6 h-6" />
      </button>
    </header>
  );
};

export default MobileNav;
