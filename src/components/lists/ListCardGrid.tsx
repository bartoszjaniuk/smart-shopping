import type { FC } from "react";

import type { ListSummaryDto } from "../../types";
import ListCard from "./ListCard";

interface ListCardGridProps {
  lists: ListSummaryDto[];
  onCardClick?: (id: string) => void;
}

const ListCardGrid: FC<ListCardGridProps> = ({ lists, onCardClick }) => {
  if (!lists.length) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {lists.map((list) => (
        <ListCard key={list.id} list={list} onClick={onCardClick} />
      ))}
    </div>
  );
};

export default ListCardGrid;
