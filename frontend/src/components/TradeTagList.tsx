import './TradeTags.css';

interface TradeTagListProps {
  tags?: string[] | null;
  emptyText?: string;
}

const TradeTagList = ({ tags, emptyText = '-' }: TradeTagListProps) => {
  if (!tags || tags.length === 0) {
    return <span>{emptyText}</span>;
  }

  return (
    <div className="trade-tags-inline">
      {tags.map(tag => (
        <span key={tag} className="trade-tags-inline__tag">
          {tag}
        </span>
      ))}
    </div>
  );
};

export default TradeTagList;
