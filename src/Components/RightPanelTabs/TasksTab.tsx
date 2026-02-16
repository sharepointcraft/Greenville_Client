import * as React from 'react';
import styles from './TasksTab.module.scss';

const tasks = [
  { title: 'Review trust draft', assignee: 'Advisor', dueDate: '2026-02-14', status: 'In Progress' },
  { title: 'Collect beneficiary forms', assignee: 'Client', dueDate: '2026-02-18', status: 'Pending' },
  { title: 'Finalize annual checklist', assignee: 'Paralegal', dueDate: '2026-02-20', status: 'Not Started' },
];

const TasksTab: React.FC = () => (
  <div className={styles.container}>
    {tasks.map((task) => (
      <div className={styles.taskRow} key={task.title}>
        <div className={styles.taskTitle}>{task.title}</div>
        <div className={styles.taskMeta}>{task.assignee}</div>
        <div className={styles.taskMeta}>{task.dueDate}</div>
        <div className={styles.taskStatus}>{task.status}</div>
      </div>
    ))}
  </div>
);

export default TasksTab;
