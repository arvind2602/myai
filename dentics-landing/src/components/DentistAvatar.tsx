import Image from "next/image";
import dr1Image from "../assets/dr1.png";

const DentistAvatar = () => {
  return (
    <div className="flex flex-col items-center p-6 bg-white rounded-lg shadow-lg">
      <Image
        src={dr1Image}
        alt="Dentist Avatar"
        width={200}
        height={200}
        className="rounded-full border-4 border-accent"
      />
      <h2 className="mt-4 text-2xl font-bold text-accent">Dr. AI Dentist</h2>
      <p className="text-md text-secondary">Your AI Dental Consultant</p>
    </div>
  );
};

export default DentistAvatar;
