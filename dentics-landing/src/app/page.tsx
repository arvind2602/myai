/**
 * @file page.tsx
 * @summary This is the main page component for the Dentics landing page.
 * It orchestrates the layout by importing and rendering various section components
 * such as Header, Hero, HowTo, Services, Benefits, Team, Booking, and Footer.
 * This component serves as the entry point for the landing page's content.
 */
import Benefits from "@/components/Benefits";
import Booking from "@/components/Booking";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import HowTo from "@/components/HowTo";
import Services from "@/components/Services";
import Team from "@/components/Team";

const Home = () => (
	<>
		<Header />
		<Hero />
		<HowTo />
		<Services />
		<Benefits />
		<Team />
		<Booking />
		<Footer />
	</>
);

export default Home;
