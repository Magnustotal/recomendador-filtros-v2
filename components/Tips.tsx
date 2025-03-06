// components/Tips.tsx
import React, { useState } from "react";

interface TipsProps {
  tips: string[]; // Un array de strings (los consejos)
}

const Tips: React.FC<TipsProps> = ({ tips }) => {
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  const nextTip = () => {
    setCurrentTipIndex((prevIndex) => (prevIndex + 1) % tips.length);
  };

  const prevTip = () => {
    setCurrentTipIndex((prevIndex) =>
      prevIndex === 0 ? tips.length - 1 : prevIndex - 1,
    );
  };

  return (
    <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 my-4 rounded relative">
      <div className="absolute top-0 right-0 mt-2 mr-2">
        {" "}
        {/* Contenedor para los botones */}
        <button
          onClick={prevTip}
          className="text-yellow-600 hover:text-yellow-800 mr-2 focus:outline-none"
        >
          ⬅️
        </button>
        <button
          onClick={nextTip}
          className="text-yellow-600 hover:text-yellow-800 focus:outline-none"
        >
          ➡️
        </button>
      </div>
      <p className="font-bold">Consejo:</p>
      <p>{tips[currentTipIndex]}</p>
    </div>
  );
};

export default Tips;