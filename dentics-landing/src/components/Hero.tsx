import FlexSection from "./FlexSection";
import Image from "next/image";
import heroImage from "../assets/hero.svg";
import ButtonLink from "./ButtonLink";

const Hero = () => (
	<FlexSection>
		<div className="flex-1">
			<h1 className="text-[2.6rem] font-bold tracking-wide">
				We <span className="text-accent">qualitatively</span> perform all types
				of dental services
			</h1>
			<p className="mt-6 text-lg text-secondary">
				A modern dental clinic where you can get qualified consultation and
				treatment
			</p>
            <div className="mt-16 flex items-center gap-7">
                <ButtonLink href="#booking">
                    Book an appointment
                </ButtonLink>
                <ButtonLink href="#services" variant="secondary">
                    Learn more
                </ButtonLink>
            </div>
		</div>
		<div className="flex-1 hidden lg:block">
			<Image className="w-full" src={heroImage} alt="hero" />
		</div>
	</FlexSection>
);

export default Hero;
