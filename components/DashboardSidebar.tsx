'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HomeIcon,
  FolderIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  ServerIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Bars3Icon,
  XMarkIcon,
  CogIcon,
} from '@heroicons/react/24/outline';
import IdeaMemLogo from './IdeaMemLogo';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileMenuOpen: boolean;
  onMobileMenuToggle: () => void;
}

const navigationItems = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Projects', href: '/projects', icon: FolderIcon },
  { name: 'Constraints', href: '/constraints', icon: ShieldCheckIcon },
  { name: 'Documentation', href: '/docs', icon: DocumentTextIcon },
  { name: 'Admin', href: '/admin', icon: ServerIcon },
];

export default function DashboardSidebar({ 
  collapsed, 
  onToggle, 
  mobileMenuOpen, 
  onMobileMenuToggle 
}: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={onMobileMenuToggle}
          className="p-2 rounded-md bg-white shadow-md border border-gray-200 text-gray-600 hover:text-gray-900"
        >
          {mobileMenuOpen ? (
            <XMarkIcon className="h-6 w-6" />
          ) : (
            <Bars3Icon className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={onMobileMenuToggle}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed lg:relative top-0 left-0 h-screen z-40
          bg-white border-r border-gray-200 shadow-sm
          transition-all duration-300 ease-in-out flex flex-col
          ${collapsed ? 'w-16' : 'w-64'}
          ${mobileMenuOpen 
            ? 'translate-x-0' 
            : '-translate-x-full lg:translate-x-0'
          }
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          {!collapsed && (
            <IdeaMemLogo size={32} className="text-purple-600" showText={true} />
          )}
          
          {collapsed && (
            <div className="mx-auto">
              <IdeaMemLogo size={32} className="text-purple-600" showText={false} />
            </div>
          )}

          {/* Desktop toggle button */}
          <button
            onClick={onToggle}
            className="hidden lg:block p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            {collapsed ? (
              <ChevronRightIcon className="h-4 w-4" />
            ) : (
              <ChevronLeftIcon className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => onMobileMenuToggle()} // Close mobile menu on navigation
                className={`
                  flex items-center px-3 py-2 rounded-md text-sm font-medium
                  transition-colors duration-200
                  ${active
                    ? 'bg-purple-50 text-purple-700 border-r-2 border-purple-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }
                  ${collapsed ? 'justify-center' : ''}
                `}
                title={collapsed ? item.name : undefined}
              >
                <Icon 
                  className={`h-5 w-5 flex-shrink-0 ${
                    active ? 'text-purple-600' : 'text-gray-400'
                  }`} 
                />
                {!collapsed && (
                  <span className="ml-3">{item.name}</span>
                )}
              </Link>
            );
          })}
        </nav>

          {/* Footer */}
        <div className="border-t border-gray-200 p-4 flex-shrink-0">
          {!collapsed ? (
            <div className="text-xs text-gray-500 space-y-1">
              <div>IdeaMem v1.0</div>
              <div>Semantic Memory System</div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-xs text-gray-500 font-medium">v1</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}