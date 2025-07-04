"use client";

import SectionHeading from "./SectionHeading";
import Wrapper from "./Wrapper";
import teamMember from "../assets/dr1.png";
import TeamMember from "./TeamMember";
import Carousel from "./Carousel";

const Team = () => (
	<section id="team">
		<Wrapper>
			<SectionHeading
				direction="right"
				title={
					<>
						Meet our team of{" "}
						<span className="text-[2.6rem] font-bold">professionals</span>
					</>
				}
				subtitle={
					<>
						Our <span className="text-accent">best</span> specialists
					</>
				}
			/>
			<div className="mt-20">
				<Carousel className="px-20">
					{Array.from(Array(6), (_, index) => (
						<TeamMember
							image={teamMember}
							name="Dr. Arvind Gupta"
							occupation="Periodontist"
							key={index}
						/>
					))}
				</Carousel>
			</div>
		</Wrapper>
	</section>
);

export default Team;
