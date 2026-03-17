// src/components/Sidebar.tsx

import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/session', icon: '💬', label: '聊天' },
  { to: '/overview', icon: '📊', label: '总览' },
  { to: '/conversations', icon: '📋', label: '对话' },
  { to: '/settings', icon: '⚙️', label: '设置' },
  { to: '/logs', icon: '📜', label: '日志', disabled: true },
]

export function Sidebar() {
  return (
    <nav className="w-16 bg-gray-900 border-r border-gray-700 flex flex-col items-center py-3 gap-1 shrink-0">
      {NAV_ITEMS.map(item => (
        item.disabled ? (
          <div
            key={item.to}
            className="flex flex-col items-center justify-center w-12 h-12 rounded-lg text-gray-600 cursor-not-allowed"
            title={`${item.label}（开发中）`}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="text-[10px] mt-0.5">{item.label}</span>
          </div>
        ) : (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-12 h-12 rounded-lg transition-colors ${
                isActive
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`
            }
          >
            <span className="text-lg">{item.icon}</span>
            <span className="text-[10px] mt-0.5">{item.label}</span>
          </NavLink>
        )
      ))}
    </nav>
  )
}
