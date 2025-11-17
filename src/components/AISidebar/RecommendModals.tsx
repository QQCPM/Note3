import React, { useState } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAction?: () => void;
}

// Flashcard data
const flashcardsData = [
  {
    question: "What is backpropagation?",
    answer: "An algorithm for training neural networks by calculating gradients of the loss function with respect to weights, allowing the network to learn from errors."
  },
  {
    question: "What is the purpose of an activation function?",
    answer: "Activation functions introduce non-linearity into neural networks, enabling them to learn complex patterns. Common examples include ReLU, Sigmoid, and Tanh."
  },
  {
    question: "What is gradient descent?",
    answer: "An optimization algorithm that iteratively adjusts network weights in the direction that minimizes the loss function, using the negative gradient."
  },
  {
    question: "What is overfitting?",
    answer: "When a model learns the training data too well, including noise and outliers, resulting in poor performance on new, unseen data."
  },
];

export const MindmapModal: React.FC<ModalProps> = ({ isOpen, onClose, onAction }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-icon">◈</span>
            <h2 className="modal-title">Neural Networks Mindmap</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="modal-section">
            <p className="modal-description">
              Visual overview of your study guide showing key concepts and their relationships.
            </p>
          </div>

          <div className="mindmap-container">
            {/* Center Node */}
            <div className="mindmap-node center">Neural Networks</div>
            <div className="mindmap-connector"></div>

            {/* Level 1 */}
            <div className="mindmap-level">
              <div className="mindmap-branch">
                <div className="mindmap-node">Architecture</div>
                <div className="mindmap-connector"></div>
                <div className="mindmap-children">
                  <div className="mindmap-node">Layers</div>
                  <div className="mindmap-node">Neurons</div>
                  <div className="mindmap-node">Connections</div>
                </div>
              </div>

              <div className="mindmap-branch">
                <div className="mindmap-node">Training</div>
                <div className="mindmap-connector"></div>
                <div className="mindmap-children">
                  <div className="mindmap-node">Backpropagation</div>
                  <div className="mindmap-node">Gradient Descent</div>
                  <div className="mindmap-node">Loss Functions</div>
                </div>
              </div>

              <div className="mindmap-branch">
                <div className="mindmap-node">Activation</div>
                <div className="mindmap-connector"></div>
                <div className="mindmap-children">
                  <div className="mindmap-node">ReLU</div>
                  <div className="mindmap-node">Sigmoid</div>
                  <div className="mindmap-node">Tanh</div>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-section">
            <div className="bg-[#161b22] rounded-lg p-3 border border-[#30363d]">
              <div className="text-xs text-gray-400 mb-1 font-semibold">Interactive Mindmap</div>
              <p className="text-xs text-gray-500 leading-relaxed">
                This visualization helps you see how concepts connect and build upon each other.
              </p>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="modal-btn modal-btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="modal-btn modal-btn-primary" onClick={onAction}>
            Add to Note
          </button>
        </div>
      </div>
    </div>
  );
};

export const ConceptsModal: React.FC<ModalProps> = ({ isOpen, onClose, onAction }) => {
  if (!isOpen) return null;

  const concepts = [
    {
      title: "Convolutional Neural Networks",
      description: "Image processing and computer vision. Convolution layers, pooling, feature detection. Applications in image classification and object detection."
    },
    {
      title: "Recurrent Neural Networks",
      description: "Sequence processing with RNNs and LSTMs. Time series analysis, natural language processing, and temporal dependencies."
    },
    {
      title: "Transformer Architectures",
      description: "Modern NLP architecture. Self-attention mechanisms, positional encoding, and sequence-to-sequence tasks."
    },
    {
      title: "Attention Mechanisms",
      description: "Focus on relevant input data. Critical for translation, summarization, and context understanding."
    },
    {
      title: "Generative Adversarial Networks",
      description: "Two networks compete to generate synthetic data. Image generation, style transfer, and data augmentation."
    }
  ];

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-icon">▪</span>
            <h2 className="modal-title">Advanced Concepts</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="modal-section">
            <p className="modal-description">
              Expand your knowledge with these advanced concepts. Each topic builds on your current understanding.
            </p>
          </div>

          <div className="modal-section">
            <h3 className="modal-section-title">Topics to Explore</h3>
            <div className="concept-list">
              {concepts.map((concept, idx) => (
                <div key={idx} className="concept-item">
                  <div className="concept-item-title">
                    <span>—</span>
                    <span>{concept.title}</span>
                  </div>
                  <p className="concept-item-desc">{concept.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="modal-btn modal-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="modal-btn modal-btn-primary" onClick={onAction}>
            ✓ Add to Note
          </button>
        </div>
      </div>
    </div>
  );
};

export const FlashcardsModal: React.FC<ModalProps> = ({ isOpen, onClose, onAction }) => {
  const [currentCard, setCurrentCard] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (!isOpen) return null;

  const handleFlip = () => setFlipped(!flipped);
  const handleNext = () => {
    if (currentCard < flashcardsData.length - 1) {
      setCurrentCard(currentCard + 1);
      setFlipped(false);
    }
  };
  const handlePrev = () => {
    if (currentCard > 0) {
      setCurrentCard(currentCard - 1);
      setFlipped(false);
    }
  };

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-icon">▭</span>
            <h2 className="modal-title">Flashcards</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="modal-section">
            <p className="modal-description">
              Review key concepts with interactive flashcards. Click or tap to flip.
            </p>
          </div>

          <div className="flashcard-container">
            <div className="flashcard-wrapper">
              <div className={`flashcard ${flipped ? 'flipped' : ''}`} onClick={handleFlip}>
                <div className="flashcard-face flashcard-front">
                  <div className="flashcard-label">Question</div>
                  <div className="flashcard-text">{flashcardsData[currentCard].question}</div>
                  <div className="flashcard-hint">Click to reveal answer</div>
                </div>
                <div className="flashcard-face flashcard-back">
                  <div className="flashcard-label">Answer</div>
                  <div className="flashcard-text">{flashcardsData[currentCard].answer}</div>
                </div>
              </div>
            </div>

            <div className="flashcard-controls">
              <button
                className="flashcard-btn"
                onClick={handlePrev}
                disabled={currentCard === 0}
              >
                ←
              </button>
              <span className="flashcard-counter">
                {currentCard + 1} / {flashcardsData.length}
              </span>
              <button
                className="flashcard-btn"
                onClick={handleNext}
                disabled={currentCard === flashcardsData.length - 1}
              >
                →
              </button>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="modal-btn modal-btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="modal-btn modal-btn-primary" onClick={onAction}>
            💾 Save All Flashcards
          </button>
        </div>
      </div>
    </div>
  );
};

export const ExercisesModal: React.FC<ModalProps> = ({ isOpen, onClose, onAction }) => {
  if (!isOpen) return null;

  const exercises = [
    {
      title: "Build a Simple Perceptron",
      description: "Create a basic perceptron from scratch using NumPy. Implement forward propagation and training loop."
    },
    {
      title: "Implement Activation Functions",
      description: "Code ReLU, Sigmoid, and Tanh functions with derivatives. Visualize gradient flow effects."
    },
    {
      title: "Multi-Layer Network",
      description: "Build a 3-layer network using TensorFlow/Keras. Train on MNIST dataset for digit classification."
    },
    {
      title: "Custom Loss Function",
      description: "Implement a custom loss in PyTorch. Define backward passes and integrate into training."
    },
    {
      title: "Backpropagation from Scratch",
      description: "Advanced: Implement complete backpropagation without frameworks. Calculate gradients manually."
    }
  ];

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-icon">{'{ }'}</span>
            <h2 className="modal-title">Practice Problems</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="modal-section">
            <p className="modal-description">
              Hands-on Python exercises to reinforce your knowledge. Each exercise includes starter code.
            </p>
          </div>

          <div className="modal-section">
            <h3 className="modal-section-title">Available Exercises</h3>
            <div className="concept-list">
              {exercises.map((ex, idx) => (
                <div key={idx} className="concept-item">
                  <div className="concept-item-title">
                    <span>●</span>
                    <span>{ex.title}</span>
                  </div>
                  <p className="concept-item-desc">{ex.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="modal-btn modal-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="modal-btn modal-btn-primary" onClick={onAction}>
            ✓ Add to Note
          </button>
        </div>
      </div>
    </div>
  );
};

export const ResourcesModal: React.FC<ModalProps> = ({ isOpen, onClose, onAction }) => {
  if (!isOpen) return null;

  const resources = [
    {
      type: "Book",
      title: "Deep Learning",
      description: "Goodfellow, Bengio, and Courville. Comprehensive coverage of neural networks, optimization, and modern architectures.",
      link: "deeplearningbook.org"
    },
    {
      type: "Course",
      title: "Stanford CS231n",
      description: "Convolutional Neural Networks. Video lectures, assignments, and comprehensive course notes.",
      link: "cs231n.stanford.edu"
    },
    {
      type: "Video",
      title: "3Blue1Brown Neural Networks",
      description: "Visual explanations of gradient descent, backpropagation, and network architecture fundamentals.",
      link: "youtube.com/3blue1brown"
    },
    {
      type: "Paper",
      title: "Attention Is All You Need",
      description: "Transformer architecture paper (2017). Foundation of GPT, BERT, and modern NLP models.",
      link: "arxiv.org/abs/1706.03762"
    },
    {
      type: "Tutorial",
      title: "PyTorch Tutorials",
      description: "Official PyTorch documentation. Build and train networks with practical examples.",
      link: "pytorch.org/tutorials"
    },
    {
      type: "Interactive",
      title: "TensorFlow Playground",
      description: "Browser-based visualization. Experiment with architectures and see real-time training.",
      link: "playground.tensorflow.org"
    }
  ];

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-icon">∞</span>
            <h2 className="modal-title">Resources</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="modal-section">
            <p className="modal-description">
              Handpicked resources to deepen your understanding. From research papers to video tutorials.
            </p>
          </div>

          <div className="modal-section">
            <h3 className="modal-section-title">Recommended Resources</h3>
            <div className="resource-list">
              {resources.map((res, idx) => (
                <div key={idx} className="resource-item">
                  <span className="resource-type">{res.type}</span>
                  <div className="resource-title">{res.title}</div>
                  <p className="resource-desc">{res.description}</p>
                  <a href="#" className="resource-link" onClick={(e) => e.preventDefault()}>
                    {res.link} →
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="modal-btn modal-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="modal-btn modal-btn-primary" onClick={onAction}>
            📎 Add Links to Note
          </button>
        </div>
      </div>
    </div>
  );
};
