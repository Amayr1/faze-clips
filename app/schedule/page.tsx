import type {Metadata} from 'next';
import ScheduleBoard from '@/components/schedule-board';
export const metadata:Metadata={title:'Stream schedule — FaZe Clips',description:'Your next live moment: a weekly schedule for 12 featured streamers and the active FaZe directory.'};
export default function SchedulePage(){return <ScheduleBoard/>;}
