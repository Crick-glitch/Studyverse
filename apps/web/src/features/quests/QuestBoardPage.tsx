import common from '../../ui/common.module.css';
import { PageHeader } from '../../ui/PageHeader';
import { Tabs } from '../../ui/Tabs';
import { QuestsPanel } from './QuestsPanel';
import { TasksPanel } from './TasksPanel';

export function QuestBoardPage() {
  return (
    <section className={common.page} aria-labelledby="quests-title">
      <PageHeader id="quests-title" icon="quests">
        Quest Board
      </PageHeader>
      <div className={common.panel}>
        <Tabs
          label="Quest board sections"
          tabs={[
            { id: 'tasks', label: 'My Tasks', panel: <TasksPanel /> },
            { id: 'adventure', label: 'Adventure Quests', panel: <QuestsPanel /> },
          ]}
        />
      </div>
    </section>
  );
}
