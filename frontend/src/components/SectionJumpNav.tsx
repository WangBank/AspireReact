import { useEffect, useMemo, useState } from 'react';
import './SectionJumpNav.css';

export interface SectionJumpItem {
  id: string;
  label: string;
  badge?: string;
}

interface SectionJumpNavProps {
  items: SectionJumpItem[];
  title?: string;
  className?: string;
}

const SectionJumpNav = ({
  items,
  title = '模块索引',
  className = '',
}: SectionJumpNavProps) => {
  const visibleItems = useMemo(
    () => items.filter(item => item.id.trim() !== '' && item.label.trim() !== ''),
    [items],
  );
  const [activeId, setActiveId] = useState(visibleItems[0]?.id ?? '');

  useEffect(() => {
    if (visibleItems.length === 0) {
      setActiveId('');
      return;
    }

    const updateActiveSection = () => {
      const existingSections = visibleItems
        .map(item => ({ item, element: document.getElementById(item.id) }))
        .filter(entry => entry.element);

      if (existingSections.length === 0) {
        return;
      }

      const scrollOffset = window.innerWidth <= 768 ? 120 : 150;
      let nextActiveId = existingSections[0].item.id;

      for (const section of existingSections) {
        const top = section.element!.getBoundingClientRect().top;
        if (top - scrollOffset <= 0) {
          nextActiveId = section.item.id;
        } else {
          break;
        }
      }

      setActiveId(nextActiveId);
    };

    updateActiveSection();
    window.addEventListener('scroll', updateActiveSection, { passive: true });
    window.addEventListener('resize', updateActiveSection);

    return () => {
      window.removeEventListener('scroll', updateActiveSection);
      window.removeEventListener('resize', updateActiveSection);
    };
  }, [visibleItems]);

  if (visibleItems.length === 0) {
    return null;
  }

  const handleJump = (id: string) => {
    const target = document.getElementById(id);
    if (!target) {
      return;
    }

    target.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  return (
    <section className={`section-jump-nav ${className}`.trim()}>
      <div className="section-jump-nav__header">
        <p className="section-jump-nav__title">{title}</p>
        <span className="section-jump-nav__count">{visibleItems.length} 个模块</span>
      </div>
      <div className="section-jump-nav__list">
        {visibleItems.map(item => (
          <button
            key={item.id}
            type="button"
            className={`section-jump-nav__item ${activeId === item.id ? 'section-jump-nav__item--active' : ''}`.trim()}
            onClick={() => handleJump(item.id)}
          >
            <span>{item.label}</span>
            {item.badge ? <span className="section-jump-nav__badge">{item.badge}</span> : null}
          </button>
        ))}
      </div>
    </section>
  );
};

export default SectionJumpNav;
