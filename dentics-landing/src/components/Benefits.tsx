import FlexSection from "./FlexSection";
import laserImage from "../assets/laser.svg";
import scannerImage from "../assets/scanner.svg";
import implantImage from "../assets/implant.svg";
import Image from "next/image";
import BenefitItem from "./BenefitItem";
import SectionHeading from "./SectionHeading";

const Benefits = () => (
	<FlexSection id="benefits">
		<SectionHeading
			direction="left"
			title={
				<>
					What makes our clinic{" "}
					<span className="text-[2.6rem] font-bold">outstanding</span>
				</>
			}
			subtitle={
				<>
					Our <span className="text-accent">features</span>
				</>
			}
		/>
		<div className="mt-20 flex gap-4 lg:gap-14 w-full justify-between flex-col sm:flex-row">
			<BenefitItem
				Icon={<Image className="w-24 h-24" src={laserImage} alt="laser" />}
				name="Modern Lasers"
				description="Advanced Diode Lasers. Your treatment will be fast and painless"
			/>
			<BenefitItem
				className="lg:mt-12"
				Icon={<Image className="w-24 h-24" src={scannerImage} alt="scanner" />}
				name="3D Scanners"
				description="High-tech 3D scanners take high-speed pictures automatically"
			/>
			<BenefitItem
				Icon={<Image className="w-24 h-24" src={implantImage} alt="implant" />}
				name="Dental Implants"
				description="30+ years of implant installations. You will be able to enjoy your favorite food again!"
			/>
		</div>
	</FlexSection>
);

export default Benefits;
